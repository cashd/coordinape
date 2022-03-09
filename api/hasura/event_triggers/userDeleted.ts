import type { VercelRequest, VercelResponse } from '@vercel/node';

import { gql } from '../../../api-lib/Gql';
import { NotFoundError } from '../../../api-lib/HttpError';
import { EventTriggerPayload } from '../../../api-lib/types';
import { verifyHasuraRequestMiddleware } from '../../../api-lib/validate';

async function handler(req: VercelRequest, res: VercelResponse) {
  // no parsing should be needed here since this data comes straight from
  // the database and zeus keeps this consistent for us
  const {
    event: { data },
  }: EventTriggerPayload<'users', 'UPDATE'> = req.body;

  if (data.old.deleted_at || !data.new.deleted_at) {
    // user wasn't just deleted, so nothing to do
    return res
      .status(200)
      .json({ message: `user wasn't soft deleted, nothing to do` });
  }

  // this user has been deleted, so we need to cleanup:
  // - sent and received pending gifts
  // - teammate entries

  const { pending_sent_gifts, pending_received_gifts } = await getPendingGifts(
    data.old.id
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

  await gql.deleteTeammate(data.old.id);

  return res.status(200).json({
    message: `refunds completed`,
    // results,
  });
}

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
    throw new NotFoundError('unable to find gifts deleted user');
  }
  return users_by_pk;
};

export default verifyHasuraRequestMiddleware(handler);
