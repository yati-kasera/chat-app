import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { GroupService } from './group.service';
import { AuthGuard } from '@nestjs/passport';

interface JwtUserReq {
  user: { userId: string; email: string; username: string };
}

@Controller('groups')
@UseGuards(AuthGuard('jwt'))
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Post()
  async createGroup(
    @Body() data: { name: string; memberIds?: string[] },
    @Request() req: JwtUserReq
  ) {
    return this.groupService.createGroup(data.name, req.user.userId, data.memberIds || []);
  }

  @Get()
  async getUserGroups(@Request() req: JwtUserReq) {
    return this.groupService.getUserGroups(req.user.userId);
  }

  @Get(':id')
  async getGroupById(@Param('id') groupId: string) {
    return this.groupService.getGroupById(groupId);
  }

  @Post(':id/members')
  async addMemberToGroup(
    @Param('id') groupId: string,
    @Body() data: { userId: string },
    @Request() req: JwtUserReq
  ) {
    return this.groupService.addMemberToGroup(groupId, data.userId, req.user.userId);
  }

  @Delete(':id/members/:userId')
  async removeMemberFromGroup(
    @Param('id') groupId: string,
    @Param('userId') userId: string,
    @Request() req: JwtUserReq
  ) {
    return this.groupService.removeMemberFromGroup(groupId, userId, req.user.userId);
  }

  @Put(':id')
  async updateGroupName(
    @Param('id') groupId: string,
    @Body() data: { name: string }
  ) {
    return this.groupService.updateGroupName(groupId, data.name);
  }

  @Delete(':id')
  async deleteGroup(@Param('id') groupId: string) {
    return this.groupService.deleteGroup(groupId);
  }
}
