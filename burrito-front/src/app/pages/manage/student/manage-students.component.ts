import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackgroundDivComponent } from '../../../component/shared/background-div/background-div.component';
import { GoBackComponent } from '../../../component/shared/go-back/go-back.component';
import { AdminPageHeaderComponent } from '../../../component/shared/admin-page-header/admin-page-header.component';
import { AdminTableComponent, TableColumn } from '../../../component/shared/admin-table/admin-table.component';
import { EditUserModalComponent } from '../../../component/shared/edit-user-modal/edit-user-modal.component';
import { AddUserModalComponent } from '../../../component/shared/add-user-modal/add-user-modal.component';
import { UserService, UserProfile } from '../../../services/user.service';
import { firstValueFrom } from 'rxjs';
import { AlertDialogComponent } from '../../../component/shared/alert-dialog/alert-dialog.component';

type AlertDialogIntent = 'primary' | 'danger';

interface AlertDialogConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  intent?: AlertDialogIntent;
}

interface StudentRow {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
  groups: {
    id: string;
    name: string;
  }[];
}

@Component({
  selector: 'app-manage-students',
  standalone: true,
  imports: [
    CommonModule,
    BackgroundDivComponent,
    GoBackComponent,
    AdminPageHeaderComponent,
    AdminTableComponent,
    EditUserModalComponent,
    AddUserModalComponent,
    AlertDialogComponent,
  ],
  templateUrl: './manage-students.component.html',
  styleUrls: ['./manage-students.component.scss'],
})
export class ManageStudentsComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly userService = inject(UserService);

  tableColumns: TableColumn[] = [
    { key: 'name', label: $localize`:@@manageStudents.name:Student Name`, type: 'user' },
    { key: 'email', label: $localize`:@@manageStudents.email:Email Address`, type: 'text' },
    { key: 'groups', label: $localize`:@@manageStudents.groups:Assigned Groups`, type: 'groups' },
    { key: 'actions', label: $localize`:@@manageStudents.actions:Actions`, type: 'actions' },
  ];

  students = signal<StudentRow[]>([]);
  loading = signal<boolean>(false);
  hasMore = signal<boolean>(true);
  loadMoreDisabled = signal<boolean>(false);

  selectedUser: UserProfile | null = null;
  showAddModal = false;

  alertDialogOpen = false;
  alertDialogTitle = $localize`:@@manageStudents.confirmActionTitle:Confirm action`;
  alertDialogMessage = '';
  alertDialogConfirmLabel = $localize`:@@manageStudents.confirmAction:Confirm`;
  alertDialogCancelLabel = $localize`:@@manageStudents.cancelAction:Cancel`;
  alertDialogShowCancel = true;
  alertDialogIntent: AlertDialogIntent = 'primary';
  private alertDialogAction: (() => void) | null = null;
  private lastCursor: string | null = null;
  private loadMoreObserver?: IntersectionObserver;
  private pageSize = 25;

  @ViewChild('loadMoreTrigger') loadMoreTrigger?: ElementRef<HTMLDivElement>;

  constructor() {}

  ngOnInit(): void {
    this.loadStudents();
  }

  ngAfterViewInit(): void {
    this.setupLoadMoreObserver();
  }

  ngOnDestroy(): void {
    this.loadMoreObserver?.disconnect();
  }

  loadStudents(): void {
    this.loading.set(true);
    this.lastCursor = null;
    this.fetchStudents(true).finally(() => {
      this.loading.set(false);
    });
  }

  loadMoreStudents(): void {
    this.loadMoreDisabled.set(true);
    this.fetchStudents(false).finally(() => {
      this.loadMoreDisabled.set(false);
    });
  }

  private fetchStudents(reset: boolean): Promise<void> {
    return firstValueFrom(
      this.userService.getStudentsPage(this.pageSize, reset ? null : this.lastCursor),
    )
      .then((result) => {
        const rows = result.users.map((user) => this.mapStudentRow(user));
        if (reset) {
          this.students.set(rows);
        } else {
          this.students.set([...this.students(), ...rows]);
        }
        this.hasMore.set(result.pageInfo.hasNextPage);
        this.lastCursor = result.pageInfo.endCursor;
      })
      .catch((err) => {
        console.error('Error loading students:', err);
        this.hasMore.set(false);
      });
  }

  private mapStudentRow(user: UserProfile): StudentRow {
    return {
      id: user.id,
      name: user.fullName || $localize`:@@manageStudents.unknown:Unknown`,
      email: user.email || $localize`:@@manageStudents.notAvailable:N/A`,
      createdAt: user.createdAt,
      groups: user.groups || [],
    };
  }

  onAdd() {
    this.showAddModal = true;
  }

  closeAddModal() {
    this.showAddModal = false;
  }

  onDelete(id: any) {
    this.openAlertDialog(
      {
        title: $localize`:@@manageStudents.unenrollTitle:Unenroll student`,
        message: $localize`:@@manageStudents.unenrollConfirm:Are you sure you want to unenroll this student?`,
        confirmLabel: $localize`:@@manageStudents.unenrollAction:Unenroll`,
        intent: 'danger',
      },
      () => {
        this.userService.deleteUser(String(id)).subscribe({
          next: () => {
            console.log('Student deleted successfully');
            this.refreshData();
          },
          error: (err) => {
            console.error('Error deleting student:', err);
            this.openAlertDialog({
              title: $localize`:@@manageStudents.unenrollFailed:Unenroll failed`,
              message: $localize`:@@manageStudents.unenrollError:Failed to delete student.`,
              confirmLabel: $localize`:@@manageStudents.ok:Ok`,
              showCancel: false,
            });
          },
        });
      },
    );
  }

  onEdit(id: any) {
    const found = this.students().find((s) => String(s.id) === String(id));
    if (found) {
      this.selectedUser = {
        id: found.id,
        fullName: found.name,
        email: found.email,
        userType: 'STUDENT',
        createdAt: found.createdAt,
        groups: found.groups || [],
      };
    }
  }

  closeEditModal() {
    this.selectedUser = null;
  }

  refreshData() {
    this.selectedUser = null;
    this.showAddModal = false;
    this.loadStudents();
  }

  openAlertDialog(config: AlertDialogConfig, action?: () => void): void {
    this.alertDialogTitle = config.title;
    this.alertDialogMessage = config.message;
    this.alertDialogConfirmLabel =
      config.confirmLabel ?? $localize`:@@manageStudents.confirmAction:Confirm`;
    this.alertDialogCancelLabel =
      config.cancelLabel ?? $localize`:@@manageStudents.cancelAction:Cancel`;
    this.alertDialogShowCancel = config.showCancel ?? true;
    this.alertDialogIntent = config.intent ?? 'primary';
    this.alertDialogAction = action ?? null;
    this.alertDialogOpen = true;
  }

  confirmAlertDialog(): void {
    const action = this.alertDialogAction;
    this.closeAlertDialog();
    if (action) {
      action();
    }
  }

  closeAlertDialog(): void {
    this.alertDialogOpen = false;
    this.alertDialogAction = null;
  }

  private setupLoadMoreObserver(): void {
    if (!this.loadMoreTrigger?.nativeElement) {
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    this.loadMoreObserver?.disconnect();
    this.loadMoreObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          return;
        }
        if (!this.hasMore() || this.loadMoreDisabled() || this.loading()) {
          return;
        }
        this.loadMoreStudents();
      },
      { root: null, rootMargin: '200px', threshold: 0 },
    );

    this.loadMoreObserver.observe(this.loadMoreTrigger.nativeElement);
  }
}
