import { Request, Response } from 'express';
declare class DashboardController {
    getStats(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    getWidgets(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    getActivity(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
export declare const dashboardController: DashboardController;
export default dashboardController;
//# sourceMappingURL=dashboard.controller.d.ts.map