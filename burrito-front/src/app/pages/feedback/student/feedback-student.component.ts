import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BackgroundDivComponent } from '../../../component/shared/background-div/background-div.component';
import { ButtonComponent } from '../../../component/shared/button/button.component';
import { InputComponent } from '../../../component/shared/input/input.component';
import { StarRatingComponent } from '../../../component/shared/star-rating/star-rating.component';
import { SelectComponent, SelectOption } from '../../../component/shared/select/select.component';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [
    FormsModule,
    BackgroundDivComponent,
    ButtonComponent,
    InputComponent,
    StarRatingComponent,
    SelectComponent,
  ],
  templateUrl: './feedback-student.component.html',
  styleUrls: ['./feedback-student.component.scss'],
})
export class FeedbackStudentComponent {
  teacherName = '';
  subject = '';
  courseLevel: string | number | null = null;
  classGroup = '';
  overallRating = 0;
  clarityRating: number | null = null;
  organizationRating: number | null = null;
  supportRating: number | null = null;
  workload: string | number | null = null;
  positives = '';
  improvements = '';
  advice = '';
  respectRules = false;

  ratingOptions: SelectOption[] = [
    { label: '5 - Outstanding', value: 5 },
    { label: '4 - Great', value: 4 },
    { label: '3 - Fair', value: 3 },
    { label: '2 - Needs work', value: 2 },
    { label: '1 - Poor', value: 1 },
  ];

  levelOptions: SelectOption[] = [
    { label: 'Middle school', value: 'middle' },
    { label: 'High school', value: 'high' },
    { label: 'University - Bachelor', value: 'bachelor' },
    { label: 'University - Master', value: 'master' },
    { label: 'Other / prep class', value: 'other' },
  ];

  workloadOptions: SelectOption[] = [
    { label: 'Very light', value: 'very-light' },
    { label: 'Manageable', value: 'medium' },
    { label: 'Intense', value: 'intense' },
  ];

  submitAttempted = false;

  get formInvalid(): boolean {
    return !this.isFormValid();
  }

  onSubmit() {
    this.submitAttempted = true;

    if (this.formInvalid) {
      return;
    }

    const payload = {
      teacherName: this.teacherName,
      subject: this.subject,
      courseLevel: this.courseLevel,
      classGroup: this.classGroup,
      overallRating: this.overallRating,
      clarityRating: this.clarityRating,
      organizationRating: this.organizationRating,
      supportRating: this.supportRating,
      workload: this.workload,
      positives: this.positives,
      improvements: this.improvements,
      advice: this.advice,
      respectRules: this.respectRules,
    };

    // TODO: replace with API call
    console.log('Feedback submitted', payload);
  }

  isFormValid(): boolean {
    return Boolean(
      this.teacherName.trim() &&
        this.subject.trim() &&
        this.courseLevel &&
        this.classGroup.trim() &&
        this.overallRating > 0 &&
        this.clarityRating &&
        this.organizationRating &&
        this.supportRating &&
        this.workload &&
        this.positives.trim() &&
        this.improvements.trim() &&
        this.advice.trim() &&
        this.respectRules
    );
  }
}
