// Fonction Netlify : expose l'agent « Questions des élèves » sur /api/chat.
import { handleChat } from "../../agents/faq/handler.js";

export default (request) => handleChat(request);

export const config = { path: "/api/chat" };
