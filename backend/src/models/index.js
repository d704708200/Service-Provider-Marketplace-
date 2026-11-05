const User = require('./User');
const Customer = require('./Customer');
const Provider = require('./Provider');
const Category = require('./Category');
const Service = require('./Service');
const ServiceArea = require('./ServiceArea');
const Availability = require('./Availability');
const Booking = require('./Booking');
const Review = require('./Review');
const Notification = require('./Notification');
const Admin = require('./Admin');
const BannerConfig = require('./BannerConfig');
const DeviceToken = require('./DeviceToken');
const HomeBanner = require('./HomeBanner');
const ProviderWallet = require('./ProviderWallet');
const WalletTransaction = require('./WalletTransaction');
const WithdrawalRequest = require('./WithdrawalRequest');
const ServiceTag = require('./ServiceTag');
const SystemSetting = require('./SystemSetting');
const ProviderSlotReservation = require('./ProviderSlotReservation');

module.exports = {
  User,
  Customer,
  Provider,
  Category,
  Service,
  ServiceTag,
  ServiceArea,
  Availability,
  Booking,
  Review,
  Notification,
  Admin,
  BannerConfig,
  DeviceToken,
  HomeBanner,
  ProviderWallet,
  WalletTransaction,
  WithdrawalRequest,
  SystemSetting,
  ProviderSlotReservation
};
