import { CspReportController } from './csp-report.controller';

describe('CspReportController', () => {
  it('accepts and logs CSP violation reports without returning a body', () => {
    const controller = new CspReportController();
    const warn = jest.spyOn((controller as any).logger, 'warn').mockImplementation();

    expect(controller.report({ 'csp-report': { 'blocked-uri': 'inline' } })).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('blocked-uri'));
  });
});
