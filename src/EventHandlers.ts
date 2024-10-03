import {
  Exchange,
  Exchange_type12,
  Exchange_type13,
  makerOrder,
  takerOrder,
  Pool
} from "generated";
import { nanoid } from "nanoid";

function getMakerOrderId(
  maker: string,
  side: "Buy" | "Sell",
  nonce: BigInt
) {
  return `${maker}:${side}:${nonce}`
}

function getMakerOrderIdFromTaker(takerOrder: takerOrder) {
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
  eventOrder: Exchange_type12,
  status: "Placed" | "Canceled" | "Filled" | "Updated",
  create_time: number,
  update_time: number
): makerOrder {

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
    status,
    create_time,
    update_time
  };
}

function decodeTakerOrder(
  eventOrder: Exchange_type13,
  create_time: number
): takerOrder {
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
    create_time
  };
}

Exchange.OrderPlaced.handler(async ({ event, context }) => {
  const time = event.block.time
  const makerOrder = decodeMarketOrder(event.params.order, "Placed", time, 0);
  context.OrderPlaced.set({
    id: nanoid(),
    order_id: makerOrder.id,
  });
  context.MakerOrder.set(makerOrder);
});

Exchange.OrderUpdated.handler(async ({ event, context }) => {
  const time = event.block.time
  const id = getMakerOrderId(
    event.params.order.maker.bits,
    event.params.order.side.case,
    event.params.order.nonce
  );
  const create_time = (await context.MakerOrder.get(id))?.create_time
  const makerOrder = decodeMarketOrder(event.params.order, "Updated", create_time!, time);
  context.OrderUpdated.set({
    id: nanoid(),
    order_id: makerOrder.id,
  });
  context.MakerOrder.set(makerOrder);
});

Exchange.OrderExecuted.handler(async ({ event, context }) => {
  const time = event.block.time
  const takerOrder = decodeTakerOrder(event.params.order, time);
  context.OrderExecuted.set({
    id: nanoid(),
    order_id: takerOrder.id,
  });
  context.TakerOrder.set(takerOrder);

  const id = getMakerOrderIdFromTaker(takerOrder)
  const makerOrder = await context.MakerOrder.get(id)
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
      status: "Filled",
      create_time: makerOrder.create_time,
      update_time: time
    })
  }
});

Exchange.OrderCanceled.handler(async ({ event, context }) => {
  const time = event.block.time
  context.OrderCanceled2.set({
    id: nanoid(),
    user: event.params.user.bits,
    nonce: event.params.nonce,
    side: event.params.side.case
  });

  const id = getMakerOrderId(
    event.params.user.bits,
    event.params.side.case,
    event.params.nonce
  );
  const makerOrder = await context.MakerOrder.get(id)

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
      status: "Canceled",
      create_time: makerOrder.create_time,
      update_time: time
    })
  }
});

Pool.Deposit.handler(async ({ event, context }) => {
  const userAddress = event.params.address.payload.bits
  const user = await context.UserBidBalance.get(userAddress)

  if (user) {
    const prevBidBalance = user.bid_balance
    const newBidBalance = prevBidBalance + event.params.amount
    context.UserBidBalance.set({
      id: user.id,
      bid_balance: newBidBalance
    });
  } else {
    context.UserBidBalance.set({
      id: userAddress,
      bid_balance: event.params.amount
    });
  }
});

Pool.Withdrawal.handler(async ({ event, context }) => {
  const userAddress = event.params.address.payload.bits
  const user = await context.UserBidBalance.get(userAddress)

  if (user) {
    const prevBidBalance = user.bid_balance
    const newBidBalance = prevBidBalance - event.params.amount
    context.UserBidBalance.set({
      id: user.id,
      bid_balance: newBidBalance
    });
  }
});

Pool.Transfer.handler(async ({ event, context }) => {
  // const fromUserAddress = event.params.from.payload.bits

  // const fromUser = await context.UserBidBalance.get(fromUserAddress)

  // if (fromUser) {
  //   const prevBidBalance = fromUser.bid_balance
  //   const newBidBalance = prevBidBalance - event.params.amount
  //   context.UserBidBalance.set({
  //     id: fromUser.id,
  //     bid_balance: newBidBalance
  //   });
  // }
});
