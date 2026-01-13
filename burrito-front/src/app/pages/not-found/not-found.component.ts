import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ButtonComponent } from '../../component/shared/button/button.component';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonComponent],
  template: `
    <section class="not-found">
      <div class="not-found__content">
        <h1 class="not-found__title">404</h1>
        <p class="not-found__message">Page not found</p>
        <p class="not-found__description">The page you're looking for doesn't exist or the link has expired.</p>
        <app-button 
          variant="primary"
          [routerLink]="'/'">
          Go to home
        </app-button>
      </div>
    </section>
  `,
  styles: [
    `
      .not-found {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: calc(100vh - 60px);
        padding: 2rem;
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      }

      .not-found__content {
        text-align: center;
        background: white;
        padding: 3rem 2rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        max-width: 500px;
      }

      .not-found__title {
        font-size: 6rem;
        font-weight: 900;
        margin: 0;
        color: #3f51b5;
        line-height: 1;
      }

      .not-found__message {
        font-size: 1.5rem;
        font-weight: 600;
        color: #333;
        margin: 1rem 0 0.5rem 0;
      }

      .not-found__description {
        color: #666;
        margin: 0 0 2rem 0;
        line-height: 1.6;
      }
    `
  ]
})
export class NotFoundComponent {}
