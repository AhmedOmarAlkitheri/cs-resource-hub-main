/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TrackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.track.findMany({
      orderBy: {
        id: 'asc',
      },
    });
  }

  async findById(id: number) {
    return this.prisma.track.findUnique({
      where: {
        id,
      },
    });
  }

  async findByDepartmentId(departmentId: number) {
    return this.prisma.track.findMany({
      where: {
        departmentId,
      },
      orderBy: {
        id: 'asc',
      },
    });
  }

  async create(departmentId: number, name: string) {
    return this.prisma.track.create({
      data: {
        departmentId,
        name,
      },
    });
  }

  async delete(id: number) {
    return this.prisma.$transaction(async (tx) => {
      // 1. حذف المقررات المسندة لهذا التخصص
      await tx.courseOffering.deleteMany({
        where: { trackId: id },
      });
      // 2. حذف التخصص
      return tx.track.delete({
        where: { id },
      });
    });
  }
}
