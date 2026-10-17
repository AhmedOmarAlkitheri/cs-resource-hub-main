import { EditCourseHandler } from './courses/edit-course.handler';
import { AssignCourseHandler } from './courses/assign-course.handler';
import { AddCourseHandler } from './courses/add-course.handler';
import { DeleteCourseHandler } from './courses/delete-course.handler';
import { CloneYearHandler } from './courses/clone-year.handler';
import { ManageOfferingsHandler } from './courses/manage-offerings.handler';

import { AddMaterialHandler } from './materials/add-material.handler';
import { DeleteMaterialHandler } from './materials/delete-material.handler';

import { AddExamHandler } from './exams/add-exam.handler';
import { DeleteExamHandler } from './exams/delete-exam.handler';

import { PromoteUserHandler } from './users/promote-user.handler';
import { DemoteAdminHandler } from './users/demote-user.handler';
import { DeleteUserHandler } from './users/delete-user.handler';
import { ListAdminsHandler } from './users/list-admins.handler';
import { ManagePermissionsHandler } from './users/manage-permissions.handler';
import { StructureHandler } from './structure/structure.handler';

import { ExternalHandler } from './external/external.handler';

export const AdminHandlers = [
  AddCourseHandler,
  EditCourseHandler,
  DeleteCourseHandler,
  AssignCourseHandler,
  ManageOfferingsHandler,
  CloneYearHandler,

  AddMaterialHandler,
  DeleteMaterialHandler,

  AddExamHandler,
  DeleteExamHandler,

  PromoteUserHandler,
  DemoteAdminHandler,
  DeleteUserHandler,
  ListAdminsHandler,
  ManagePermissionsHandler,

  StructureHandler,
  ExternalHandler,
];

