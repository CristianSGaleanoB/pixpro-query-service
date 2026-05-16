import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ProjectsService } from './projects.service';
import { ProjectsRepository } from './repositories/projects.repository';
import { RedisService } from '../redis/redis.service';

const TEST_PROJECT_ID = 'test-proj-int-001';
const TEST_PROJECTS_KEY = 'projects';

describe('ProjectsService (Integration)', () => {
  let module: TestingModule;
  let projectsService: ProjectsService;
  let redisService: RedisService;

  const mockBrokerService = {
    subscribe: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
          ignoreEnvFile: false,
        }),
      ],
      providers: [
        ProjectsService,
        ProjectsRepository,
        RedisService,
        {
          provide: require('../broker/broker.service').BrokerService,
          useValue: mockBrokerService,
        },
      ],
    }).compile();

    projectsService = module.get<ProjectsService>(ProjectsService);
    redisService = module.get<RedisService>(RedisService);

    await new Promise((resolve) => setTimeout(resolve, 200));
  });

  afterAll(async () => {
    await redisService.del(TEST_PROJECTS_KEY);
    await module.close();
  });

  beforeEach(async () => {
    await redisService.del(TEST_PROJECTS_KEY);
  });

  describe('getProjects', () => {
    it('should return empty array if no projects in Redis', async () => {
      const projects = await projectsService.getProjects();
      expect(projects).toEqual([]);
    });
  });

  describe('handleProjectCreated', () => {
    it('should add project to Redis when event is received', async () => {
      const event = {
        event: 'ProjectCreated',
        id: TEST_PROJECT_ID,
        name: 'Test Project',
        description: 'Integration test',
        ownerId: 'user-123',
        timestamp: new Date().toISOString(),
      };

      await (projectsService as unknown as Record<string, Function>).handleProjectCreated(event);

      const projects = await projectsService.getProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0]).toMatchObject({
        id: TEST_PROJECT_ID,
        name: 'Test Project',
      });
    });

    it('should not add duplicate project', async () => {
      const event = {
        event: 'ProjectCreated',
        id: TEST_PROJECT_ID,
        name: 'Test Project',
        ownerId: 'user-123',
        timestamp: new Date().toISOString(),
      };

      await (projectsService as unknown as Record<string, Function>).handleProjectCreated(event);
      await (projectsService as unknown as Record<string, Function>).handleProjectCreated(event);

      const projects = await projectsService.getProjects();
      expect(projects).toHaveLength(1);
    });
  });
});
