import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AcademicYearRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.academicYear.findMany({
      orderBy: {
        startYear: 'desc',
      },
    });
  }

  async findById(id: number) {
    return this.prisma.academicYear.findUnique({
      where: {
        id,
      },
    });
  }

  async create(startYear: number, endYear: number) {
    return this.prisma.academicYear.create({
      data: {
        startYear,
        endYear,
      },
    });
  }

  async delete(id: number) {
    return this.prisma.$transaction(async (tx) => {
      // حذف المقررات المسندة لهذه السنة أولاً
      await tx.courseOffering.deleteMany({
        where: { academicYearId: id },
      });
      // ثم حذف السنة الدراسية
      return tx.academicYear.delete({
        where: { id },
      });
    });
  }
}
