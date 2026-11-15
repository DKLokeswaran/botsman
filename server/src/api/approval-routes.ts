import { type Approval, ApprovalAnswer, type ApprovalList, ApprovalListQuery, IdParams } from "@botsman/protocol";
import type { FastifyInstance } from "fastify";
import { notFound } from "../errors.ts";
import type { Services } from "../services.ts";

export function registerApprovalRoutes(app: FastifyInstance, services: Services): void {
  const { approvalStore, policy } = services;
  const liveBotIds = () => services.bots.list().map((bot) => bot.id);

  // Approvals of deleted bots are left out.
  app.get<{ Querystring: ApprovalListQuery }>("/api/approvals", { schema: { querystring: ApprovalListQuery } }, async (request): Promise<ApprovalList> => {
    const botIds = request.query.botId === undefined ? liveBotIds() : liveBotIds().filter((id) => id === request.query.botId);
    return { approvals: approvalStore.list({ status: request.query.status, botIds }) };
  });

  app.post<{ Params: IdParams; Body: ApprovalAnswer }>("/api/approvals/:id/answer", { schema: { params: IdParams, body: ApprovalAnswer } }, async (request): Promise<Approval> => {
    const approval = approvalStore.get(request.params.id);
    if (!liveBotIds().includes(approval.botId)) throw notFound("Approval");
    return policy.answer(approval.id, request.body.decision);
  });
}
