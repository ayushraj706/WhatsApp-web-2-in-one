import { io } from "socket.io-client";

let socket;

export function getSocket(backendToken) {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_BACKEND_URL, {
      auth: { token: backendToken },
      transports: ["websocket"],
    });
  }
  return socket;
}
