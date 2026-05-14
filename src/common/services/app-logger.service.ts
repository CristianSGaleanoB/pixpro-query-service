import { LoggerService } from '@nestjs/common';
import { Logger as NestLogger } from '@nestjs/common/services';

export class AppLogger implements LoggerService {
  private readonly logger: NestLogger;

  constructor(context = 'App') {
    this.logger = new NestLogger(context);
  }

  appStarted(port: number, prefix = 'api'): void {
    this.logger.log(`Server started on http://localhost:${port}/${prefix}`);
  }

  databaseConnected(dbName: string, host: string): void {
    this.logger.log(`${dbName} connected to ${host}`);
  }

  request(data: {
    method: string;
    url: string;
    ip: string;
    statusCode?: number;
    duration?: number;
  }): void {
    const { method, url, statusCode, duration, ip } = data;
    const statusMsg = statusCode ? ` [${statusCode}]` : '';
    const durationMsg = duration ? ` (${duration}ms)` : '';

    this.logger.log(`${method} ${url}${statusMsg}${durationMsg} - ${ip}`);
  }

  requestError(data: { method: string; url: string; ip: string; error: string }): void {
    const { method, url, ip, error } = data;
    this.logger.error(`${method} ${url} - ${ip} | ${error}`);
  }

  log(message: string) {
    this.logger.log(message);
  }

  error(message: string, trace?: string) {
    this.logger.error(message, trace);
  }

  warn(message: string) {
    this.logger.warn(message);
  }

  debug(message: string) {
    this.logger.debug(message);
  }

  verbose(message: string) {
    this.logger.verbose(message);
  }
}
