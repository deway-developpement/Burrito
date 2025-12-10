import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-star-rating',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './star-rating.component.html',
  styleUrls: ['./star-rating.component.scss'],
})
export class StarRatingComponent {
  @Input() rating = 0;
  @Input() max = 5;
  @Input() readOnly = false;
  @Output() ratingChange = new EventEmitter<number>();

  stars = Array.from({ length: this.max }, (_, i) => i + 1);
  hovered = 0;

  rate(star: number) {
    if (this.readOnly) return;
    this.rating = star;
    this.ratingChange.emit(this.rating);
  }

  setHover(star: number) {
    if (this.readOnly) return;
    this.hovered = star;
  }

  resetHover() {
    this.hovered = 0;
  }

  isFilled(star: number) {
    const active = this.hovered || this.rating;
    return star <= active;
  }
}
