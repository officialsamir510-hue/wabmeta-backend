import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
export declare const initializeSocket: (server: HttpServer) => Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export declare const getIO: () => Server;
declare const _default: {
    initializeSocket: (server: HttpServer) => Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
    getIO: () => Server;
};
export default _default;
//# sourceMappingURL=socket.d.ts.map