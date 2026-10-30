import { startApiServer } from "./api/server";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

startApiServer(PORT);
