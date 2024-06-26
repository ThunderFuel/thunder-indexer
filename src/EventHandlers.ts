import {
  ExchangeContract,
  ExchangeContract_type_id_12,
  ExchangeContract_type_id_21,
  makerOrderEntity,
  takerOrderEntity,
  PoolContract,
} from "generated";
import { nanoid } from "nanoid";

function tai64ToDate(tai64: bigint) {
  const dateStr = (
    (tai64 - BigInt(Math.pow(2, 62)) - BigInt(10)) *
    1000n
  ).toString();
  return new Date(+dateStr).toUTCString();
}

function getMakerOrderId(maker: string, side: "Buy" | "Sell", nonce: BigInt) {
  return `${maker}:${side}:${nonce}`
}

function getMakerOrderIdFromTaker(takerOrder: takerOrderEntity) {
  let id: string;

  const side = takerOrder.side;
  const maker = takerOrder.maker;
  const nonce = takerOrder.nonce;

  switch (side) {
    case "Buy":
      id = `${maker}:Sell:${nonce}`
      break;
    case "Sell":
      id = `${maker}:Buy:${nonce}`
      break;
  }
  return id;
}

function decodeMarketOrder(
  eventOrder: ExchangeContract_type_id_12,
  status: "Placed" | "Canceled" | "Filled" | "Updated"
): makerOrderEntity {

  return {
    id: `${eventOrder.maker.bits}:${eventOrder.side.case}:${eventOrder.nonce}`,
    side: eventOrder.side.case,
    maker: eventOrder.maker.bits,
    collection: eventOrder.collection.bits,
    token_id: eventOrder.token_id,
    token_key: `${eventOrder.collection.bits}:${eventOrder.token_id}`,
    price: eventOrder.price,
    amount: eventOrder.amount,
    nonce: eventOrder.nonce,
    strategy: eventOrder.strategy.bits,
    payment_asset: eventOrder.payment_asset.bits,
    start_time: tai64ToDate(eventOrder.start_time),
    end_time: tai64ToDate(eventOrder.end_time),
    status
  };
}

function decodeTakerOrder(
  eventOrder: ExchangeContract_type_id_21
): takerOrderEntity {
  return {
    id: nanoid(),
    taker: eventOrder.taker.bits,
    side: eventOrder.side.case,
    maker: eventOrder.maker.bits,
    collection: eventOrder.collection.bits,
    token_id: eventOrder.token_id,
    price: eventOrder.price,
    nonce: eventOrder.nonce,
    strategy: eventOrder.strategy.bits,
  };
}

ExchangeContract.OrderPlaced.loader(({ event, context }) => {

});

ExchangeContract.OrderPlaced.handler(({ event, context }) => {
  const makerOrder = decodeMarketOrder(event.data.order, "Placed");
  context.OrderPlaced.set({
    id: nanoid(),
    order_id: makerOrder.id,
  });
  context.MakerOrder.set(makerOrder);
});

ExchangeContract.OrderUpdated.loader(({ event, context }) => {

});

ExchangeContract.OrderUpdated.handler(({ event, context }) => {
  const makerOrder = decodeMarketOrder(event.data.order, "Updated");
  context.OrderUpdated.set({
    id: nanoid(),
    order_id: makerOrder.id,
  });
  context.MakerOrder.set(makerOrder);
});

ExchangeContract.OrderExecuted.loader(({ event, context }) => {
  const takerOrder = event.data.order
  const entity = decodeTakerOrder(takerOrder)
  const id = getMakerOrderIdFromTaker(entity)
  context.MakerOrder.load(id)
});

ExchangeContract.OrderExecuted.handler(({ event, context }) => {
  const takerOrder = decodeTakerOrder(event.data.order);
  context.OrderExecuted.set({
    id: nanoid(),
    order_id: takerOrder.id,
  });
  context.TakerOrder.set(takerOrder);

  const id = getMakerOrderIdFromTaker(takerOrder)
  const makerOrder = context.MakerOrder.get(id)
  if (makerOrder) {
    context.MakerOrder.set({
      id,
      side: makerOrder.side,
      maker: makerOrder.maker,
      collection: makerOrder.collection,
      token_id: makerOrder.token_id,
      token_key: `${makerOrder.collection}:${makerOrder.token_id}`,
      price: makerOrder.price,
      amount: makerOrder.amount,
      nonce: makerOrder.nonce,
      strategy: makerOrder.strategy,
      payment_asset: makerOrder.payment_asset,
      start_time: makerOrder.start_time,
      end_time: makerOrder.end_time,
      status: "Filled"
    })
  }
});

ExchangeContract.OrderCanceled.loader(({ event, context }) => {
  const id = getMakerOrderId(
    event.data.user.bits,
    event.data.side.case,
    event.data.nonce
  );
  context.MakerOrder.load(id);
});

ExchangeContract.OrderCanceled.handler(({ event, context }) => {
  const id = getMakerOrderId(
    event.data.user.bits,
    event.data.side.case,
    event.data.nonce
  );
  const makerOrder = context.MakerOrder.get(id)

  if (makerOrder) {
    context.OrderCanceled.set({
      id: nanoid(),
      order_id: makerOrder.id,
    });

    context.MakerOrder.set({
      id,
      side: makerOrder.side,
      maker: makerOrder.maker,
      collection: makerOrder.collection,
      token_id: makerOrder.token_id,
      token_key: `${makerOrder.collection}:${makerOrder.token_id}`,
      price: makerOrder.price,
      amount: makerOrder.amount,
      nonce: makerOrder.nonce,
      strategy: makerOrder.strategy,
      payment_asset: makerOrder.payment_asset,
      start_time: makerOrder.start_time,
      end_time: makerOrder.end_time,
      status: "Canceled"
    })
  }
});

PoolContract.Deposit.loader(({ event, context }) => {
  const userAddress = event.data.address.payload.bits
  context.UserBidBalance.load(userAddress)
});

PoolContract.Deposit.handler(({ event, context }) => {
  const userAddress = event.data.address.payload.bits
  const user = context.UserBidBalance.get(userAddress)

  if (user) {
    const prevBidBalance = user.bid_balance
    const newBidBalance = prevBidBalance + event.data.amount
    context.UserBidBalance.set({
      id: user.id,
      bid_balance: newBidBalance
    });
  } else {
    context.UserBidBalance.set({
      id: userAddress,
      bid_balance: event.data.amount
    });
  }
});

PoolContract.Withdrawal.loader(({ event, context }) => {
  const userAddress = event.data.address.payload.bits
  context.UserBidBalance.load(userAddress)
});

PoolContract.Withdrawal.handler(({ event, context }) => {
  const userAddress = event.data.address.payload.bits
  const user = context.UserBidBalance.get(userAddress)

  if (user) {
    const prevBidBalance = user.bid_balance
    const newBidBalance = prevBidBalance - event.data.amount
    context.UserBidBalance.set({
      id: user.id,
      bid_balance: newBidBalance
    });
  }
});

PoolContract.Transfer.loader(({ event, context }) => {
  const fromUserAddress = event.data.from.payload.bits
  context.UserBidBalance.load(fromUserAddress)
});

PoolContract.Transfer.handler(({ event, context }) => {
  const fromUserAddress = event.data.from.payload.bits

  const fromUser = context.UserBidBalance.get(fromUserAddress)

  if (fromUser) {
    const prevBidBalance = fromUser.bid_balance
    const newBidBalance = prevBidBalance - event.data.amount
    context.UserBidBalance.set({
      id: fromUser.id,
      bid_balance: newBidBalance
    });
  }
});
