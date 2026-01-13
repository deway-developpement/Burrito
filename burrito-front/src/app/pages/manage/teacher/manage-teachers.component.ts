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
import { UserService, UserProfile } from '../../../services/user.service';
import { firstValueFrom } from 'rxjs';
import { EditUserModalComponent } from '../../../component/shared/edit-user-modal/edit-user-modal.component';
import { AddUserModalComponent } from '../../../component/shared/add-user-modal/add-user-modal.component';
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

interface TeacherRow {
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
  selector: 'app-manage-teachers',
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
  templateUrl: './manage-teachers.component.html',
  styleUrls: ['./manage-teachers.component.scss'],
})
export class ManageTeachersComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly userService = inject(UserService);

  tableColumns: TableColumn[] = [
    { key: 'name', label: $localize`:@@manageTeachers.name:Name`, type: 'user' },
    { key: 'email', label: $localize`:@@manageTeachers.contact:Contact`, type: 'text' },
    { key: 'groups', label: $localize`:@@manageTeachers.groups:Assigned Groups`, type: 'groups' },
    { key: 'actions', label: $localize`:@@manageTeachers.actions:Actions`, type: 'actions' },
  ];

  teachers = signal<TeacherRow[]>([]);
  loading = signal<boolean>(false);
  hasMore = signal<boolean>(true);
  loadMoreDisabled = signal<boolean>(false);

  selectedUser: UserProfile | null = null;
  showAddModal = false;

  alertDialogOpen = false;
  alertDialogTitle = $localize`:@@manageTeachers.confirmActionTitle:Confirm action`;
  alertDialogMessage = '';
  alertDialogConfirmLabel = $localize`:@@manageTeachers.confirmAction:Confirm`;
  alertDialogCancelLabel = $localize`:@@manageTeachers.cancelAction:Cancel`;
  alertDialogShowCancel = true;
  alertDialogIntent: AlertDialogIntent = 'primary';
  private alertDialogAction: (() => void) | null = null;
  private lastCursor: string | null = null;
  private loadMoreObserver?: IntersectionObserver;
  private readonly pageSize = 25;

  @ViewChild('loadMoreTrigger') loadMoreTrigger?: ElementRef<HTMLDivElement>;

  constructor() {}

  ngOnInit(): void {
    this.loadTeachers();
  }

  ngAfterViewInit(): void {
    this.setupLoadMoreObserver();
  }

  ngOnDestroy(): void {
    this.loadMoreObserver?.disconnect();
  }

  loadTeachers(): void {
    this.loading.set(true);
    this.lastCursor = null;
    this.fetchTeachers(true).finally(() => {
      this.loading.set(false);
    });
  }

  loadMoreTeachers(): void {
    this.loadMoreDisabled.set(true);
    this.fetchTeachers(false).finally(() => {
      this.loadMoreDisabled.set(false);
    });
  }

  private fetchTeachers(reset: boolean): Promise<void> {
    return firstValueFrom(
      this.userService.getTeachersPage(this.pageSize, reset ? null : this.lastCursor),
    )
      .then((result) => {
        const rows = result.users.map((user) => this.mapTeacherRow(user));
        if (reset) {
          this.teachers.set(rows);
        } else {
          this.teachers.set([...this.teachers(), ...rows]);
        }
        this.hasMore.set(result.pageInfo.hasNextPage);
        this.lastCursor = result.pageInfo.endCursor;
      })
      .catch((err) => {
        console.error('Error loading teachers:', err);
        this.hasMore.set(false);
      });
  }

  private mapTeacherRow(user: UserProfile): TeacherRow {
    return {
      id: user.id,
      name: user.fullName || $localize`:@@manageTeachers.unknown:Unknown`,
      email: user.email || $localize`:@@manageTeachers.notAvailable:N/A`,
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
        title: $localize`:@@manageTeachers.deleteTitle:Delete teacher`,
        message: $localize`:@@manageTeachers.deleteConfirm:Are you sure you want to delete this teacher?`,
        confirmLabel: $localize`:@@manageTeachers.deleteAction:Delete`,
        intent: 'danger',
      },
      () => {
        this.userService.deleteUser(String(id)).subscribe({
          next: () => {
            console.log('User deleted successfully');
            this.refreshData();
          },
          error: (err) => {
            console.error('Error deleting user:', err);
            this.openAlertDialog({
              title: $localize`:@@manageTeachers.deleteFailed:Delete failed`,
              message: $localize`:@@manageTeachers.deleteError:Failed to delete user.`,
              confirmLabel: $localize`:@@manageTeachers.ok:Ok`,
              showCancel: false,
            });
          },
        });
      },
    );
  }

  onEdit(id: any) {
    const user = this.teachers().find((t) => String(t.id) === String(id));
    if (user) {
      this.selectedUser = {
        id: user.id,
        fullName: user.name,
        email: user.email,
        userType: 'TEACHER',
        createdAt: user.createdAt,
        groups: user.groups || [],
      };
    }
  }

  closeEditModal() {
    this.selectedUser = null;
  }

  refreshData() {
    this.selectedUser = null;
    this.showAddModal = false;
    this.loadTeachers();
  }

  openAlertDialog(config: AlertDialogConfig, action?: () => void): void {
    this.alertDialogTitle = config.title;
    this.alertDialogMessage = config.message;
    this.alertDialogConfirmLabel =
      config.confirmLabel ?? $localize`:@@manageTeachers.confirmAction:Confirm`;
    this.alertDialogCancelLabel =
      config.cancelLabel ?? $localize`:@@manageTeachers.cancelAction:Cancel`;
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
        this.loadMoreTeachers();
      },
      { root: null, rootMargin: '200px', threshold: 0 },
    );

    this.loadMoreObserver.observe(this.loadMoreTrigger.nativeElement);
  }
}
