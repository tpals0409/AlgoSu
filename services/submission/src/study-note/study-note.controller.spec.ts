import { Test, TestingModule } from '@nestjs/testing';
import { StudyNoteController } from './study-note.controller';
import { StudyNoteService } from './study-note.service';
import { InternalKeyGuard } from '../common/guards/internal-key.guard';
import { StudyMemberGuard } from '../common/guards/study-member.guard';

describe('StudyNoteController', () => {
  let controller: StudyNoteController;
  let studyNoteService: jest.Mocked<StudyNoteService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudyNoteController],
      providers: [
        {
          provide: StudyNoteService,
          useValue: {
            upsert: jest.fn(),
            findByProblemAndStudy: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(InternalKeyGuard).useValue({ canActivate: () => true })
      .overrideGuard(StudyMemberGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<StudyNoteController>(StudyNoteController);
    studyNoteService = module.get(StudyNoteService);
  });

  describe('upsert()', () => {
    it('메모를 생성/수정하고 반환한다', async () => {
      const dto = { problemId: 'prob-1', content: 'my note' } as any;
      const mockNote = { id: 'note-1', ...dto };
      studyNoteService.upsert.mockResolvedValue(mockNote as any);

      const result = await controller.upsert(dto, 'user-1', 'study-1');

      expect(result).toEqual({ data: mockNote });
      expect(studyNoteService.upsert).toHaveBeenCalledWith(dto, 'user-1', 'study-1');
    });
  });

  describe('find()', () => {
    it('문제+스터디별 메모를 반환한다', async () => {
      const mockNote = { id: 'note-1', content: 'note' };
      studyNoteService.findByProblemAndStudy.mockResolvedValue(mockNote as any);

      const result = await controller.find('prob-1', 'study-1');

      expect(result).toEqual({ data: mockNote });
      expect(studyNoteService.findByProblemAndStudy).toHaveBeenCalledWith('prob-1', 'study-1');
    });
  });
});
