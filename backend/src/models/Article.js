import mongoose from 'mongoose';

const articleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    cover: { type: String, default: '' },
    excerpt: { type: String, default: '' },
    content: { type: String, default: '' },
    category: {
      type: String,
      enum: ['setup', 'maintenance', 'aquascaping', 'health', 'guide'],
      default: 'guide',
    },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    tags: [String],
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

articleSchema.index({ title: 'text', excerpt: 'text', content: 'text' });

const Article = mongoose.model('Article', articleSchema);
export default Article;
