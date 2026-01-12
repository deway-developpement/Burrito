import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { GoBackComponent } from '../../component/shared/go-back/go-back.component';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [GoBackComponent],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss']
})
export class ContactComponent {
  private router = inject(Router);
  private toast = inject(ToastService);

  onSubmit(event: Event): void {
    event.preventDefault(); // Empêche le rechargement natif de la page
    
    // Simulation de l'envoi...

    // 1. Show Success Toast
    this.toast.show('Message sent successfully! We will get back to you soon.', 'success');

    // 2. Redirect to Home with a small delay
    // Le délai permet à l'utilisateur de voir le message avant que la page ne change
    setTimeout(() => {
      this.router.navigate(['/']);
    }, 1500); 
  }
}