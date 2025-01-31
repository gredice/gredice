import { Hono } from "hono";

import weather from "./weather";

const app = new Hono()
    .route('/weather', weather);

export default app;