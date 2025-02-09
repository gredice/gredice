import { Hono } from "hono";
import weather from "./weatherRoutes";
import { apiDocs } from "../../../../lib/docs/apiDocs";

const app = new Hono()
    .route('/weather', weather);

apiDocs(app, 'data', {
    info: {
        title: 'Data API',
        version: '0.1.0',
    }
});

export default app;