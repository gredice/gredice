import { Hono } from "hono";
import weather from "./weatherRoutes";

const app = new Hono()
    .route('/weather', weather);

export default app;