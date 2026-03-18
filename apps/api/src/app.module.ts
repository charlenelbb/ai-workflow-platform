import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WorkflowModule } from './workflow/workflow.module';
import { ExecutionModule } from './execution/execution.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    WorkflowModule,
    ExecutionModule,
  ],
})
export class AppModule {}
