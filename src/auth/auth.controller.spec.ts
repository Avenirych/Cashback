import { scaffoldDependencyMock } from '../../test/scaffold-mocks';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import {AuthService} from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
    }).useMocker(scaffoldDependencyMock).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
  it('public registration cannot pass owner, moderator, role or verified privileges',async()=>{
    const register=jest.fn().mockResolvedValue({});
    const c=new AuthController({register} as unknown as AuthService);
    await c.register({email:'fixture@example.invalid',password:'Fixture8!',firstName:'Fixture',lastName:'Buyer',phone_e164:'+12025550123',role:'admin',moderator:true,email_verified:true,owner:true} as any);
    expect(register).toHaveBeenCalledWith('fixture@example.invalid','Fixture8!','Fixture Buyer',{firstName:'Fixture',lastName:'Buyer',phone_e164:'+12025550123'});
  });
});
