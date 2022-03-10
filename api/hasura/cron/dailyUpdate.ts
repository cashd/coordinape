import assert from 'assert';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import dedent from 'dedent';
import { DateTime } from 'luxon';

import { gql } from '../../../api-lib/Gql';
import { verifyHasuraRequestMiddleware } from '../../../api-lib/validate';
import { pending_token_gifts_select_column } from '../../../src/lib/gql/__generated__/zeusAdmin';

async function handler(req: VercelRequest, res: VercelResponse) {
  const yesterday = DateTime.now().minus({ days: 1 }).toISO();
  try {
    const updateResult = await gql.q('query')({
      epochs: [
        {
          where: {
            end_date: { _gt: 'now()' },
            start_date: { _lt: 'now()' },
            ended: { _eq: false },
          },
        },
        {
          number: true,
          start_date: true,
          end_date: true,

          circle: {
            organization: {
              name: true,
            },
            name: true,
            token_name: true,
            discord_webhook: true,
            telegram_id: true,

            __alias: {
              optOuts: {
                users_aggregate: [
                  { where: { non_receiver: { _eq: true } } },
                  {
                    aggregate: { count: [{}, true] },
                  },
                ],
              },
              receiversTotal: {
                users_aggregate: [
                  { where: { non_receiver: { _eq: false }, role: { _lt: 2 } } },
                  { aggregate: { count: [{}, true] } },
                ],
              },
            },
          },

          __alias: {
            allocationTotals: {
              epoch_pending_token_gifts_aggregate: [
                {},
                {
                  aggregate: {
                    sum: { __alias: { sumGive: { tokens: true } } },
                    __alias: { totalAllocations: { count: [{}, true] } },
                  },
                },
              ],
            },
            sendersCount: {
              epoch_pending_token_gifts_aggregate: [
                {
                  distinct_on: [
                    pending_token_gifts_select_column.sender_address,
                  ],
                },
                { aggregate: { count: [{}, true] } },
              ],
            },
            sendersToday: {
              epoch_pending_token_gifts_aggregate: [
                {
                  where: { updated_at: { _gte: yesterday } },
                  distinct_on: [
                    pending_token_gifts_select_column.sender_address,
                  ],
                },
                {
                  nodes: {
                    sender: {
                      name: true,
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    });

    for (const epoch of updateResult.epochs) {
      const {
        start_date,
        end_date,
        sendersCount,
        sendersToday: dailySenders,
        allocationTotals,
        circle,
      } = epoch;
      assert(circle, 'epoch somehow missing circle');
      const epochEndDate = DateTime.fromISO(end_date);
      const countdownToEpochEnd = epochEndDate
        .diffNow()
        .shiftTo('weeks', 'days', 'hours')
        .toObject();

      const sendersToday =
        dailySenders.epoch_pending_token_gifts_aggregate.nodes.map(
          node => node.sender.name
        );
      const totalAllocations =
        allocationTotals.epoch_pending_token_gifts_aggregate.aggregate
          ?.totalAllocations.count;
      const tokensSent =
        allocationTotals.epoch_pending_token_gifts_aggregate.aggregate?.sum
          ?.sumGive.tokens;
      const optOuts = circle?.optOuts.users_aggregate.aggregate?.count;
      const usersAllocated =
        sendersCount.epoch_pending_token_gifts_aggregate.aggregate?.count;
      const optedInUsers =
        circle.receiversTotal.users_aggregate.aggregate?.count;

      const message = dedent`
        ${circle.organization?.name} /  ${circle.name}

        ${start_date} to ${end_date}
        Total Allocations: ${totalAllocations}
        ${circle.token_name || 'GIVE'} sent: ${tokensSent}
        Opt outs: ${optOuts ?? 0}
        Users Allocated: ${usersAllocated ?? 0} / ${optedInUsers ?? 0}
        epoch ending ${countdownToEpochEnd.weeks}w ${
        countdownToEpochEnd.days
      }d ${countdownToEpochEnd}h from now!
        Users that made new allocations today:
          ${sendersToday.join(', ')}
      `;
      console.error(message);
    }

    res.status(200).json({ message: 'No updates' });
  } catch (e) {
    res.status(401).json({
      error: '401',
      message: (e as Error).message || 'Unexpected error',
    });
  }
}

export default verifyHasuraRequestMiddleware(handler);
