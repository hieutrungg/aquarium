import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Vui lòng nhập tên'], trim: true },
    email: {
      type: String,
      required: [true, 'Vui lòng nhập email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email không hợp lệ'],
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['member', 'editor', 'admin'],
      default: 'member',
    },
    avatar: { type: String, default: '' },
    savedArticles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Article' }],
  },
  { timestamps: true }
);

// Hash mật khẩu trước khi lưu (khi field ảo `password` được set)
userSchema.virtual('password').set(function (value) {
  this._password = value;
});

// Hash trong pre('validate') để passwordHash có giá trị trước khi validate
userSchema.pre('validate', async function (next) {
  if (this._password) {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this._password, salt);
  }
  next();
});

userSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.passwordHash);
};

const User = mongoose.model('User', userSchema);
export default User;
