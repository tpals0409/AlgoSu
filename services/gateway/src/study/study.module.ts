import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudyController } from './study.controller';
import { StudyService } from './study.service';
import { Study, StudyMember, StudyInvite } from './study.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Study, StudyMember, StudyInvite])],
  controllers: [StudyController],
  providers: [StudyService],
  exports: [StudyService],
})
export class StudyModule {}
