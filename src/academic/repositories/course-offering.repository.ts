import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CourseOfferingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number) {
    return this.prisma.courseOffering.findUnique({
      where: {
        id,
      },
      include: {
        course: true,
        academicYear: true,
        department: true,
        level: true,
        term: true,
        track: true,
      },
    });
  }

  async findByContext(params: {
    departmentId: number;
    trackId?: number;
    levelId: number;
    termId: number;
    academicYearId: number;
  }) {
    return this.prisma.courseOffering.findMany({
      where: {
        departmentId: params.departmentId,
        trackId: params.trackId ?? null,
        levelId: params.levelId,
        termId: params.termId,
        academicYearId: params.academicYearId,
      },
      include: {
        course: true,
        academicYear: true,
      },
      orderBy: {
        id: 'asc',
      },
    });
  }

  async findCourses(params: {
    departmentId: number;
    trackId?: number;
    levelId: number;
    termId: number;
    academicYearId: number;
  }) {
    return this.prisma.courseOffering.findMany({
      where: {
        departmentId: params.departmentId,
        trackId: params.trackId ?? null,
        levelId: params.levelId,
        termId: params.termId,
        academicYearId: params.academicYearId,
      },
      include: {
        course: true,
      },
      orderBy: {
        course: {
          name: 'asc',
        },
      },
    });
  }

  async create(data: {
    courseId: number;
    departmentId: number;
    trackId?: number;
    levelId: number;
    termId: number;
    academicYearId: number;
  }) {
    return this.prisma.courseOffering.create({
      data: {
        courseId: data.courseId,
        departmentId: data.departmentId,
        trackId: data.trackId,
        levelId: data.levelId,
        termId: data.termId,
        academicYearId: data.academicYearId,
      },
      include: {
        course: true,
        academicYear: true,
      },
    });
  }

  async findOne(params: {
    courseId: number;
    departmentId: number;
    trackId?: number;
    levelId: number;
    termId: number;
    academicYearId: number;
  }) {
    return this.prisma.courseOffering.findFirst({
      where: {
        courseId: params.courseId,
        departmentId: params.departmentId,
        trackId: params.trackId ?? null,
        levelId: params.levelId,
        termId: params.termId,
        academicYearId: params.academicYearId,
      },
      include: {
        course: true,
        academicYear: true,
      },
    });
  }

  async findByAcademicYear(academicYearId: number) {
    return this.prisma.courseOffering.findMany({
      where: { academicYearId },
      include: {
        course: true,
        department: true,
        level: true,
        term: true,
        track: true,
      },
    });
  }

  async cloneYearOfferings(
    sourceYearId: number,
    targetYearId: number,
  ): Promise<{ copied: number; skipped: number; totalSource: number }> {
    const sourceOfferings = await this.prisma.courseOffering.findMany({
      where: { academicYearId: sourceYearId },
    });

    if (sourceOfferings.length === 0) {
      return { copied: 0, skipped: 0, totalSource: 0 };
    }

    let copied = 0;
    let skipped = 0;

    for (const item of sourceOfferings) {
      const existing = await this.prisma.courseOffering.findFirst({
        where: {
          academicYearId: targetYearId,
          courseId: item.courseId,
          departmentId: item.departmentId,
          trackId: item.trackId,
          levelId: item.levelId,
          termId: item.termId,
        },
      });

      if (existing) {
        skipped++;
      } else {
        await this.prisma.courseOffering.create({
          data: {
            academicYearId: targetYearId,
            courseId: item.courseId,
            departmentId: item.departmentId,
            trackId: item.trackId,
            levelId: item.levelId,
            termId: item.termId,
          },
        });
        copied++;
      }
    }

    return { copied, skipped, totalSource: sourceOfferings.length };
  }
}

