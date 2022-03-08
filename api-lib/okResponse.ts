import { VercelResponse } from '@vercel/node';

const okResponse = function (res: VercelResponse, json: unknown) {
  return res.status(200).json(json);
};

export default okResponse;
