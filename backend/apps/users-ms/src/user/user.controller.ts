import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { UserService } from './user.service';
import type { Query } from '@nestjs-query/core';
import { User } from './entities/user.entity';

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @MessagePattern({ cmd: 'user.query' })
  query(query: Query<User>) {
    return this.userService.query(query);
  }

  @MessagePattern({ cmd: 'user.findById' })
  findById(id: string) {
    return this.userService.findById(id);
  }

  @MessagePattern({ cmd: 'user.findByIds' })
  findByIds(ids: string[]) {
    return this.userService.findByIds(ids);
  }

  @MessagePattern({ cmd: 'user.createOne' })
  createOne(dto: Partial<User>) {
    return this.userService.create({
      email: dto.email as string,
      password: dto.password as string,
      fullName: dto.fullName as string,
      userType: dto.userType as number,
    });
  }

  @MessagePattern({ cmd: 'user.updateOne' })
  updateOne({ id, update }: { id: string; update: Partial<User> }) {
    return this.userService.updateOne(id, update);
  }

  @MessagePattern({ cmd: 'user.deleteOne' })
  deleteOne(id: string) {
    return this.userService.deleteOne(id);
  }

  @MessagePattern({ cmd: 'user.findByEmail' })
  findByEmail(email: string) {
    return this.userService.findByEmail(email);
  }

  @MessagePattern({ cmd: 'user.verifyEmail' })
  verifyEmail(token: string) {
    return this.userService.verifyEmail(token);
  }

  @MessagePattern({ cmd: 'user.resendVerification' })
  resendVerification(userId: string) {
    return this.userService.resendVerification(userId);
  }
}
