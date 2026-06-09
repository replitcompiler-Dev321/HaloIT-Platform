const { DataTypes } = require('sequelize');
const sequelize = require('./config');
const bcryptjs = require('bcryptjs');

// Role model
const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

// Permission model
const Permission = sequelize.define('Permission', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  resource: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

// Role-Permission association table
const RolePermission = sequelize.define('RolePermission', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
});

// User model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password_hash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  display_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  role_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Role,
      key: 'id',
    },
  },
  mfa_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  mfa_secret: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  mfa_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'blocked'),
    defaultValue: 'active',
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

// Backup codes for MFA recovery
const BackupCode = sequelize.define('BackupCode', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  used: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

const PasswordResetToken = sequelize.define('PasswordResetToken', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  token: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  used: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

// Audit log model
const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: User,
      key: 'id',
    },
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  entity_type: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  entity_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  ip_address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('success', 'failure'),
    defaultValue: 'success',
  },
});

// Ticket model (Phase 2 advanced ticketing)
const Ticket = sequelize.define('Ticket', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  type: {
    type: DataTypes.ENUM(
      'support',
      'request',
      'change_request',
      'maintenance',
      'system_generated'
    ),
    defaultValue: 'support',
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    defaultValue: 'medium',
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  subcategory: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  client_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'clients',
      key: 'id',
    },
  },
  assigned_agent_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: User,
      key: 'id',
    },
  },
  approval_required: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  approval_status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
  },
  time_tracked_minutes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  closure_justification: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: User,
      key: 'id',
    },
  },
  updated_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: User,
      key: 'id',
    },
  },
  sla_due_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  first_response_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  resolved_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('open', 'in_progress', 'pending', 'resolved', 'closed'),
    defaultValue: 'open',
  },
});

const TicketComment = sequelize.define('TicketComment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  ticket_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Ticket,
      key: 'id',
    },
  },
  author_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  internal: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
});

const TicketAttachment = sequelize.define('TicketAttachment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  ticket_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Ticket,
      key: 'id',
    },
  },
  uploaded_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  file_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  file_type: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  file_url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
});

const Client = sequelize.define('Client', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  reference_code: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  sla_tier: {
    type: DataTypes.ENUM('bronze', 'silver', 'gold', 'platinum', 'custom'),
    defaultValue: 'bronze',
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
  },
});

const ClientUser = sequelize.define('ClientUser', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  client_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Client,
      key: 'id',
    },
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  role: {
    type: DataTypes.ENUM('client_admin', 'client_user', 'client_viewer'),
    defaultValue: 'client_user',
  },
});

const TicketTimeEntry = sequelize.define('TicketTimeEntry', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  ticket_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Ticket,
      key: 'id',
    },
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  minutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  ended_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

const TicketApproval = sequelize.define('TicketApproval', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  ticket_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Ticket,
      key: 'id',
    },
  },
  approver_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  approval_type: {
    type: DataTypes.ENUM('manager', 'peer', 'owner'),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  reviewed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

// Define associations
Role.hasMany(User);
User.belongsTo(Role);

Role.belongsToMany(Permission, { through: RolePermission });
Permission.belongsToMany(Role, { through: RolePermission });

User.hasMany(AuditLog, { foreignKey: 'user_id' });
AuditLog.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(BackupCode, { foreignKey: 'user_id' });
BackupCode.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(PasswordResetToken, { foreignKey: 'user_id' });
PasswordResetToken.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Ticket, { foreignKey: 'created_by' });
Ticket.belongsTo(User, { foreignKey: 'created_by' });
Ticket.belongsTo(User, { as: 'assigned_agent', foreignKey: 'assigned_agent_id' });
Ticket.belongsTo(User, { as: 'updater', foreignKey: 'updated_by' });
Ticket.belongsTo(Client, { foreignKey: 'client_id' });

Client.hasMany(Ticket, { foreignKey: 'client_id' });
Client.belongsToMany(User, { through: ClientUser, foreignKey: 'client_id', otherKey: 'user_id' });
User.belongsToMany(Client, { through: ClientUser, foreignKey: 'user_id', otherKey: 'client_id' });
Client.hasMany(ClientUser, { foreignKey: 'client_id' });
ClientUser.belongsTo(Client, { foreignKey: 'client_id' });
ClientUser.belongsTo(User, { foreignKey: 'user_id' });

Ticket.hasMany(TicketTimeEntry, { foreignKey: 'ticket_id' });
TicketTimeEntry.belongsTo(Ticket, { foreignKey: 'ticket_id' });
TicketTimeEntry.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(TicketTimeEntry, { foreignKey: 'user_id' });

Ticket.hasMany(TicketComment, { foreignKey: 'ticket_id' });
TicketComment.belongsTo(Ticket, { foreignKey: 'ticket_id' });
TicketComment.belongsTo(User, { as: 'author', foreignKey: 'author_id' });
User.hasMany(TicketComment, { foreignKey: 'author_id' });

Ticket.hasMany(TicketAttachment, { foreignKey: 'ticket_id' });
TicketAttachment.belongsTo(Ticket, { foreignKey: 'ticket_id' });
TicketAttachment.belongsTo(User, { as: 'uploader', foreignKey: 'uploaded_by' });
User.hasMany(TicketAttachment, { foreignKey: 'uploaded_by' });

Ticket.hasMany(TicketApproval, { foreignKey: 'ticket_id' });
TicketApproval.belongsTo(Ticket, { foreignKey: 'ticket_id' });
TicketApproval.belongsTo(User, { as: 'approver', foreignKey: 'approver_id' });
User.hasMany(TicketApproval, { foreignKey: 'approver_id' });

// Instance methods
User.prototype.validatePassword = function(password) {
  return bcryptjs.compareSync(password, this.password_hash);
};

User.prototype.setPassword = function(password) {
  this.password_hash = bcryptjs.hashSync(password, 10);
};

module.exports = {
  sequelize,
  User,
  Role,
  Permission,
  RolePermission,
  AuditLog,
  BackupCode,
  PasswordResetToken,
  Ticket,
  Client,
  ClientUser,
  TicketTimeEntry,
  TicketApproval,
  TicketComment,
  TicketAttachment,
};
