const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      unique: true,
      trim: true,
      maxlength: [100, 'Category name cannot exceed 100 characters']
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    icon: {
      type: String,
      default: null
    },
    image: {
      type: String,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    displayOrder: {
      type: Number,
      default: 0
    },
    showInQuickServices: {
      type: Boolean,
      default: false
    },
    quickServicesOrder: {
      type: Number,
      default: 0
    },
    showInPopularServices: {
      type: Boolean,
      default: false
    },
    popularServicesOrder: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

categorySchema.index({ isActive: 1, displayOrder: 1 });
categorySchema.index({ isActive: 1, showInQuickServices: 1, quickServicesOrder: 1 });
categorySchema.index({ isActive: 1, showInPopularServices: 1, popularServicesOrder: 1 });

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
