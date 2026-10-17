import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DepartmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.department.findMany({
      orderBy: {
        id: 'asc',
      },
    });
  }

  async findById(id: number) {
    return this.prisma.department.findUnique({
      where: {
        id,
      },
    });
  }

  async create(name: string) {
    return this.prisma.department.create({
      data: {
        name,
      },
    });
  }

  async delete(id: number) {
    return this.prisma.$transaction(async (tx) => {
      // 1. حذف المقررات المسندة
      await tx.courseOffering.deleteMany({
        where: { departmentId: id },
      });
      // 2. حذف التخصصات التابعة للقسم
      await tx.track.deleteMany({
        where: { departmentId: id },
      });
      // 3. حذف القسم
      return tx.department.delete({
        where: { id },
      });
    });
  }
}
