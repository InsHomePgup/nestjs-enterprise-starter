import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: ConfigService, useValue: { get: () => 'My API' } }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('returns the service name and the package.json version', () => {
    const { version } = require('../package.json') as { version: string };
    expect(appController.getInfo()).toEqual({ name: 'My API', version });
  });
});
