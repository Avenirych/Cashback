import { scaffoldDependencyMock } from '../../test/scaffold-mocks';
import { Test, TestingModule } from '@nestjs/testing';
import { PartnersController } from './partners.controller';

describe('PartnersController', () => {
  let controller: PartnersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PartnersController],
    }).useMocker(scaffoldDependencyMock).compile();

    controller = module.get<PartnersController>(PartnersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
