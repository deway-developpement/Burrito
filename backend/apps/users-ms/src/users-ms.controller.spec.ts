import { Test, TestingModule } from '@nestjs/testing';
import { UsersMsController } from './users-ms.controller';
import { UsersMsService } from './users-ms.service';

describe('UsersMsController', () => {
  let usersMsController: UsersMsController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [UsersMsController],
      providers: [UsersMsService],
    }).compile();

    usersMsController = app.get<UsersMsController>(UsersMsController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(usersMsController.getHello()).toBe('Hello World!');
    });
  });
});
