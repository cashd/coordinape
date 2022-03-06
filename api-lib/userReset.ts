import { gql } from './Gql';
import { NotFoundError } from './HttpError';

const userReset = async function (userId: number) {
  const { pending_sent_gifts, pending_received_gifts } = await getPendingGifts(
    userId
  );

  for (const g of pending_sent_gifts) {
    // const recipientId = g.recipient_id;
    //   $rUser = $existingGift->recipient;
    await deleteGift(g.id);
    // TODO: update the pendingReceivedGifts memo on the user now that this was deleted
    //   $rUser->give_token_received = $rUser->pendingReceivedGifts()->get()->SUM('tokens');
    //   $rUser->save();
  }

  for (const g of pending_received_gifts) {
    await deleteGift(g.id);
    // TODO: update the senders give_token_remaining
    //   $sender = $gift->sender;
    //   $gift_token = $gift->tokens;
    //   $token_used = $sender->pendingSentGifts->SUM('tokens') - $gift_token;
    //   $sender->give_token_remaining = $sender->starting_tokens - $token_used;
    //   $sender->save();
  }

  //   Teammate::where('team_mate_id', $user->id)->delete();
  //   Teammate::where('user_id', $user->id)->delete();
  //   $user->give_token_remaining = $user->starting_tokens;
  //   $user->give_token_received = 0;
  //   $user->save();
};

// const deleteTeammate = async function (userId: number) {
//   return await gql.q('mutation')({
//     delete_tea,
//   });
// };

const deleteGift = async function (giftId: number) {
  return await gql.q('mutation')({
    delete_pending_token_gifts_by_pk: [
      {
        id: giftId,
      },
      {
        id: true,
      },
    ],
  });
};

const getPendingGifts = async function (senderId: number) {
  const { users_by_pk } = await gql.q('query')({
    users_by_pk: [
      {
        id: senderId,
      },
      {
        pending_sent_gifts: [
          {},
          {
            id: true,
            recipient_id: true,
          },
        ],
        pending_received_gifts: [
          {},
          {
            sender_id: true,
            id: true,
          },
        ],
      },
    ],
  });
  if (!users_by_pk) {
    throw new NotFoundError('unable to find gifts from user we are deleting');
  }
  return users_by_pk;
};

export default userReset;
