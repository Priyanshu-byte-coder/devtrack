
// Global error handler wrapper for API routes to prevent unhandled promise rejections
export const withErrorHandler = (handler: Function) => async (req: Request, res: Response) => {
  try {
    return await handler(req, res);
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
};
