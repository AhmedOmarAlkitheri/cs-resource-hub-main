import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class LevelRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.level.findMany({
      orderBy: {
        number: 'asc',
      },
    });
  }

  async findById(id: number) {
    return this.prisma.level.findUnique({
      where: {
        id,
      },
    });
  }

  async create(number: number, name: string) {
    return this.prisma.level.create({
      data: {
        number,
        name,
      },
    });
  }

  async delete(id: number) {
    return this.prisma.$transaction(async (tx) => {
      // 1. حذف المقررات المسندة لهذا المستوى
      await tx.courseOffering.deleteMany({
        where: { levelId: id },
      });
      // 2. حذف المستوى
      return tx.level.delete({
        where: { id },
      });
    });
  }
}
