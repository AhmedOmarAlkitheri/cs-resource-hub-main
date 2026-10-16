import { Injectable } from '@nestjs/common';

import { DepartmentRepository } from '../repositories/department.repository';
import { LevelRepository } from '../repositories/level.repository';
import { TermRepository } from '../repositories/term.repository';
import { AcademicYearRepository } from '../repositories/academic-year.repository';
import { TrackRepository } from '../repositories/track.repository';
import { CourseOfferingRepository } from '../repositories/course-offering.repository';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class AcademicService {
  private readonly cache = new Map<string, CacheEntry<any>>();
  private readonly TTL_MS = 10 * 60 * 1000; // 10 دقائق تخزين مؤقت للسرعة الفائقة

  constructor(
    private readonly departmentRepository: DepartmentRepository,
    private readonly levelRepository: LevelRepository,
    private readonly termRepository: TermRepository,
    private readonly academicYearRepository: AcademicYearRepository,
    private readonly trackRepository: TrackRepository,
    private readonly courseOfferingRepository: CourseOfferingRepository,
  ) {}

  private async getOrSetCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const data = await fetcher();
    this.cache.set(key, { data, expiresAt: now + this.TTL_MS });
    return data;
  }

  clearCache(): void {
    this.cache.clear();
  }

  // ============================================================
  // Departments
  // ============================================================

  async getDepartments() {
    return this.getOrSetCache('departments', () =>
      this.departmentRepository.findAll(),
    );
  }

  async getDepartmentById(id: number) {
    return this.getOrSetCache(`department_${id}`, () =>
      this.departmentRepository.findById(id),
    );
  }

  // ============================================================
  // Levels
  // ============================================================

  async getLevels() {
    return this.getOrSetCache('levels', () =>
      this.levelRepository.findAll(),
    );
  }

  async getLevelById(id: number) {
    return this.getOrSetCache(`level_${id}`, () =>
      this.levelRepository.findById(id),
    );
  }

  // ============================================================
  // Terms
  // ============================================================

  async getTerms() {
    return this.getOrSetCache('terms', () =>
      this.termRepository.findAll(),
    );
  }

  async getTermById(id: number) {
    return this.getOrSetCache(`term_${id}`, () =>
      this.termRepository.findById(id),
    );
  }

  // ============================================================
  // Academic Years
  // ============================================================

  async getAcademicYears() {
    return this.getOrSetCache('academic_years', () =>
      this.academicYearRepository.findAll(),
    );
  }

  async getAcademicYearById(id: number) {
    return this.getOrSetCache(`academic_year_${id}`, () =>
      this.academicYearRepository.findById(id),
    );
  }

  // ============================================================
  // Tracks
  // ============================================================

  async getTracks() {
    return this.getOrSetCache('tracks', () =>
      this.trackRepository.findAll(),
    );
  }

  async getTrackById(id: number) {
    return this.getOrSetCache(`track_${id}`, () =>
      this.trackRepository.findById(id),
    );
  }

  async getTracksByDepartmentId(departmentId: number) {
    return this.getOrSetCache(`tracks_dept_${departmentId}`, () =>
      this.trackRepository.findByDepartmentId(departmentId),
    );
  }

  // ============================================================
  // Course Offerings
  // ============================================================

  async getCourseOfferingById(id: number) {
    return this.courseOfferingRepository.findById(id);
  }

  async createCourseOffering(data: {
    courseId: number;
    departmentId: number;
    trackId?: number;
    levelId: number;
    termId: number;
    academicYearId: number;
  }) {
    this.clearCache();
    return this.courseOfferingRepository.create(data);
  }

  async getCourseOfferings(params: {
    departmentId: number;
    trackId?: number;
    levelId: number;
    termId: number;
    academicYearId: number;
  }) {
    const key = `offerings_${params.departmentId}_${params.trackId || 0}_${params.levelId}_${params.termId}_${params.academicYearId}`;
    return this.getOrSetCache(key, () =>
      this.courseOfferingRepository.findByContext(params),
    );
  }

  async getCoursesByContext(params: {
    departmentId: number;
    trackId?: number;
    levelId: number;
    termId: number;
    academicYearId: number;
  }) {
    const key = `courses_${params.departmentId}_${params.trackId || 0}_${params.levelId}_${params.termId}_${params.academicYearId}`;
    return this.getOrSetCache(key, () =>
      this.courseOfferingRepository.findCourses(params),
    );
  }

  async findCourseOffering(params: {
    courseId: number;
    departmentId: number;
    trackId?: number;
    levelId: number;
    termId: number;
    academicYearId: number;
  }) {
    const key = `offering_${params.courseId}_${params.departmentId}_${params.trackId || 0}_${params.levelId}_${params.termId}_${params.academicYearId}`;
    return this.getOrSetCache(key, () =>
      this.courseOfferingRepository.findOne(params),
    );
  }

  async getOfferingsByAcademicYear(academicYearId: number) {
    return this.courseOfferingRepository.findByAcademicYear(academicYearId);
  }

  async cloneYearOfferings(sourceYearId: number, targetYearId: number) {
    this.clearCache();
    return this.courseOfferingRepository.cloneYearOfferings(
      sourceYearId,
      targetYearId,
    );
  }
}
