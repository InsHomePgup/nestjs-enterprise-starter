import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ErrorCode } from '../../common/constants/error-code.enum';
import { ApiErrors } from '../../common/swagger/api-errors.decorator';
import { Role } from '../../generated/prisma/enums';
import { Auth } from '../auth/decorators/auth.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UserPageDto, UserResponseDto } from './dto/user-response.dto';
import { UserService } from './user.service';

@ApiTags('users')
@Auth(Role.ADMIN)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 用户列表
   *
   * 分页查询，按创建时间倒序；支持按邮箱模糊搜索和按角色筛选。
   */
  @Get()
  findAll(@Query() query: UserQueryDto): Promise<UserPageDto> {
    return this.userService.findAll(query);
  }

  /**
   * 用户详情
   */
  @Get(':id')
  @ApiErrors(ErrorCode.USER_NOT_FOUND)
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.userService.findOne(id);
  }

  /**
   * 更新用户
   *
   * 只更新请求中传入的字段。
   */
  @Patch(':id')
  @ApiErrors(ErrorCode.USER_NOT_FOUND)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.userService.update(id, dto);
  }

  /**
   * 删除用户
   *
   * 物理删除，同时删除该用户的所有令牌，不可恢复。
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiErrors(ErrorCode.USER_NOT_FOUND)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.userService.remove(id);
  }
}
