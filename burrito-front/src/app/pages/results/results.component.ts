import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { HeaderComponent } from '../../component/header/header.component';

type QuestionType = 'RATING' | 'TEXT';

interface EvaluationAnswer {
  questionId: string;
  rating?: number;
  text?: string;
}

interface EvaluationResult {
  id: string;
  formId: string;
  teacherId: string;
  answers: EvaluationAnswer[];
  createdAt: string;
}

interface FormQuestion {
  id: string;
  label: string;
  required: boolean;
  type: QuestionType;
}

interface FormDetails {
  id: string;
  title: string;
  description: string;
  questions: FormQuestion[];
}

interface EvaluationResponse {
  data: { evaluation: EvaluationResult | null };
}

interface FormResponse {
  data: { form: FormDetails | null };
}

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './results.component.html',
  styleUrls: ['./results.component.scss']
})
export class ResultsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  evaluationId = signal<string | null>(null);
  evaluation = signal<EvaluationResult | null>(null);
  form = signal<FormDetails | null>(null);
  loading = signal<boolean>(true);
  formLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  ngOnInit() {
    this.route.params.subscribe((params) => {
      const id = params['id'];
      this.evaluationId.set(id);
      this.loadEvaluation(id);
    });
  }

  private loadEvaluation(id: string) {
    this.loading.set(true);
    this.error.set(null);

    const token = this.authService.token();
    if (!token) {
      this.error.set('Not authenticated');
      this.loading.set(false);
      return;
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    const query = `
      query Evaluation($id: ID!) {
        evaluation(id: $id) {
          id
          formId
          teacherId
          answers { questionId rating text }
          createdAt
        }
      }
    `;

    this.http
      .post<EvaluationResponse>('/graphQL', { query, variables: { id } }, { headers })
      .subscribe({
        next: (data) => {
          if (data.data.evaluation) {
            this.evaluation.set(data.data.evaluation);
            this.loadForm(data.data.evaluation.formId, headers);
          } else {
            this.error.set('Evaluation not found');
          }
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load evaluation:', err);
          this.error.set('Failed to load evaluation results');
          this.loading.set(false);
        },
      });
  }

  private loadForm(formId: string, headers: HttpHeaders) {
    this.formLoading.set(true);

    const query = `
      query Form($id: ID!) {
        form(id: $id) {
          id
          title
          description
          questions { id label required type }
        }
      }
    `;

    this.http
      .post<FormResponse>('/graphQL', { query, variables: { id: formId } }, { headers })
      .subscribe({
        next: (data) => {
          this.form.set(data.data.form);
          this.formLoading.set(false);
        },
        error: (err) => {
          console.error('Failed to load form:', err);
          this.form.set(null);
          this.formLoading.set(false);
        },
      });
  }

  questionLabel(questionId: string): string {
    const question = this.form()?.questions.find((q) => q.id === questionId);
    return question?.label ?? 'Question';
  }

  questionType(questionId: string): QuestionType | undefined {
    return this.form()?.questions.find((q) => q.id === questionId)?.type;
  }

  displayAnswer(answer: EvaluationAnswer): string {
    if (answer.rating !== undefined && answer.rating !== null) {
      return `${answer.rating}/5`;
    }
    return answer.text || 'No response provided';
  }
}