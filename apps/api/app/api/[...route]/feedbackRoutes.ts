import { Hono } from "hono";
import { authValidator, AuthVariables } from "../../../lib/hono/authValidator";
import { createFeedback, getFeedbacks } from "@gredice/storage";
import { describeRoute } from "hono-openapi";
import { validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";

const app = new Hono<{ Variables: AuthVariables }>()
    .get(
        '/',
        describeRoute({
            description: "Get all feedback",
        }),
        authValidator(['admin']),
        async (context) => {
            const feedbacks = await getFeedbacks();
            return context.json(feedbacks);
        }
    )
    .post(
        '/',
        describeRoute({
            description: "Create a new feedback",
        }),
        zValidator(
            "json",
            z.object({
                topic: z.string().nonempty(),
                data: z.any().nullable().optional(),
                score: z.string().nullable().optional(),
                comment: z.string().nullable().optional(),
            })
        ),
        async (context) => {
            const feedback = context.req.valid("json");
            const id = await createFeedback(feedback);
            return context.json({ id });
        }
    );

export default app;