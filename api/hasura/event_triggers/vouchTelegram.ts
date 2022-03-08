import type { VercelRequest, VercelResponse } from '@vercel/node';

import { errorResponse } from '../../../api-lib/HttpError';
import okResponse from '../../../api-lib/okResponse';
import { EventTriggerPayload } from '../../../api-lib/types';
import { verifyHasuraRequestMiddleware } from '../../../api-lib/validate';

import handleVouchMsg from './utils/handleVouchMsg';

async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const payload: EventTriggerPayload<'vouches', 'INSERT'> = req.body;
    const sent = await handleVouchMsg(payload, { telegram: true });
    return okResponse(res, {
      message: `Telegram message ${sent ? 'sent' : 'not sent'}`,
    });
  } catch (e) {
    return errorResponse(res, e);
  }
}

export default verifyHasuraRequestMiddleware(handler);
