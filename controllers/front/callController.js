const { Call, CallParticipant, User, Group, GroupMember, Message, MessageStatus } = require('../../models');
const { Op } = require('sequelize');
const { fetchRecentCalls } = require('../../utils/helper-functions');

exports.initiateCall = async (req, res) => {
  const { receiverId, groupId, callType = 'audio' } = req.body;
  const initiatorId = req.session.userId;

  if (!initiatorId || (!receiverId && !groupId)) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // Determine call mode
    const callMode = groupId ? 'group' : 'direct';
    
    // Create call record
    const call = await Call.create({
      initiator_id: initiatorId,
      group_id: groupId || null,
      receiver_id: receiverId || null,
      call_type: callType,
      call_mode: callMode,
      status: 'active',
      started_at: new Date()  // you might want to explicitly set this
    });

    // Get participants list
    let participants = [];
    if (callMode === 'direct') {
      participants = [
        { user_id: initiatorId, status: 'joined' },
        { user_id: receiverId, status: 'invited' }
      ];
    } else {
      // Get all group members
      const members = await GroupMember.findAll({
        where: { group_id: groupId },
        include: [{ model: User, as: 'user', attributes: ['id', 'name', 'avatar'] }]
      });
      
      participants = members.map(member => ({
        user_id: member.user_id,
        status: member.user_id === initiatorId ? 'joined' : 'invited'
      }));
    }

    // Create call participants
    const participantData = participants.map(p => ({
      call_id: call.id,
      user_id: p.user_id,
      status: p.status,
      joined_at: p.status === 'joined' ? new Date() : null
    }));

    await CallParticipant.bulkCreate(participantData);

    // Get full call data with participants and relations
    const fullCall = await Call.findByPk(call.id, {
      include: [
        { model: User, as: 'initiator', attributes: ['id', 'name', 'avatar'] },
        { model: User, as: 'receiver', attributes: ['id', 'name', 'avatar'], required: false },
        { model: Group, as: 'group', required: false },
        {
          model: CallParticipant,
          as: 'participants',
          include: [{ model: User, as: 'user', attributes: ['id', 'name', 'avatar'] }]
        }
      ]
    });

    // Convert Sequelize instance to plain object before passing
    const fullCallPlain = fullCall.get({ plain: true });

    // Emit call invitation via Socket.IO
    const io = req.app.get('io');
    
    if (callMode === 'direct') {
      // Direct call - notify receiver
      io.to(`user_${receiverId}`).emit('incomingCall', {
        call: fullCallPlain
      });

      // Notify initiator
      io.to(`user_${initiatorId}`).emit('callInitiated', {
        call: fullCallPlain
      });
    } else {
      // Group call - notify all members except initiator
      const memberIds = participants
        .filter(p => p.user_id !== initiatorId)
        .map(p => p.user_id);
      
      memberIds.forEach(memberId => {
        io.to(`user_${memberId}`).emit('incomingCall', {
          call: fullCallPlain
        });
      });

      // Notify initiator
      io.to(`user_${initiatorId}`).emit('callInitiated', {
        call: fullCallPlain
      });
    }

    res.json({ success: true, call: fullCallPlain });

  } catch (error) {
    console.error('Error initiating call:', error);
    res.status(500).json({ error: 'Failed to initiate call' });
  }
};

exports.answerCall = async (req, res) => {
  const { callId } = req.body;
  const userId = req.session.userId;

  try {
    // Update participant status
    const [updatedRows] = await CallParticipant.update(
      { 
        status: 'joined',
        joined_at: new Date()
      },
      {
        where: {
          call_id: callId,
          user_id: userId,
          status: 'invited'
        }
      }
    );

    if (updatedRows === 0) {
      return res.status(404).json({ error: 'Call invitation not found' });
    }

    // Get updated call data
    const call = await Call.findByPk(callId, {
      include: [
        { model: User, as: 'initiator', attributes: ['id', 'name', 'avatar'] },
        { model: User, as: 'receiver', attributes: ['id', 'name', 'avatar'], required: false },
        { model: Group, as: 'group', required: false },
        {
          model: CallParticipant,
          as: 'participants',
          include: [{ model: User, as: 'user', attributes: ['id', 'name', 'avatar'] }]
        }
      ]
    });

    const callData = call.get({ plain: true });  // convert to plain object

    // Emit to all participants
    const io = req.app.get('io');
    const participantIds = callData.participants.map(p => p.user_id);
    
    participantIds.forEach(participantId => {
      io.to(`user_${participantId}`).emit('callAnswered', {
        call,
        userId
      });
    });

    res.json({ success: true, call });
  } catch (error) {
    console.error('Error answering call:', error);
    res.status(500).json({ error: 'Failed to answer call' });
  }
};

exports.declineCall = async (req, res) => {
  const { callId, reason = 'declined' } = req.body;
  const userId = req.session.userId;

  try {
   
    // Get call data
    const call = await Call.findByPk(callId, {
      include: [
        { model: User, as: 'initiator', attributes: ['id', 'name', 'avatar'] },
        { model: User, as: 'receiver', attributes: ['id', 'name', 'avatar'], required: false },
        { model: Group, as: 'group', required: false },
        {
          model: CallParticipant,
          as: 'participants',
          include: [{ model: User, as: 'user', attributes: ['id', 'name', 'avatar'] }]
        }
      ]
    });

    // Check if this is a direct call and receiver declined
    if (call.call_mode === 'direct' && call.receiver_id === userId) {
      
      // End the call
      await Call.update(
        { 
          status: 'ended',
          ended_at: new Date(),
          duration: 0
        },
        { where: { id: callId } }
      );
    }

    // Update participant status
    await CallParticipant.update(
      { status: 'declined' },
      {
        where: {
          call_id: callId,
          user_id: userId
        }
      }
    );

    // Create call message
    const callMessage = await this.createCallMessage(call, 'declined', req);

    // Emit to all participants
    const io = req.app.get('io');
    const participantIds = call.participants.map(p => p.user_id);
    
    participantIds.forEach(participantId => {
      io.to(`user_${participantId}`).emit('callDeclined', {
        call,
        userId,
        reason,
        message: callMessage
      });
    });

    res.json({ success: true, call });
  } catch (error) {
    console.error('Error declining call:', error);
    res.status(500).json({ error: 'Failed to decline call' });
  }
};

exports.endCall = async (req, res) => {
  const { callId } = req.body;
  const userId = req.session.userId;

  try {
    // Update call status
    const call = await Call.findByPk(callId);
    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }
    const callPlain = call.get({ plain: true })
    // Get all participants to calculate duration
    const participants = await CallParticipant.findAll({
      where: { 
        user_id: { [Op.ne]: callPlain.initiator_id },
        call_id: callId, 
        status: 'joined' 
      },
      order: [['joined_at', 'ASC']]
    });

    const plainParticipants = participants.map(p => p.get({ plain: true }));

    let duration = 0;
    if (plainParticipants.length > 0) {
      const firstJoinTime = plainParticipants[0].joined_at;
      const endTime = new Date();
      duration = Math.floor((endTime - firstJoinTime) / 1000);
    } else {
      duration = 0;
    }

    await Call.update(
      { 
        status: 'ended',
        ended_at: new Date(),
        duration: duration
      },
      { where: { id: callId } }
    );

    // Update participant who ended the call
    await CallParticipant.update(
      { 
        status: 'left',
        left_at: new Date()
      },
      {
        where: {
          call_id: callId,
          user_id: userId,
          status: 'joined'
        }
      }
    );

    // Get updated call data
    const updatedCall = await Call.findByPk(callId, {
      include: [
        { model: User, as: 'initiator', attributes: ['id', 'name', 'avatar'] },
        { model: User, as: 'receiver', attributes: ['id', 'name', 'avatar'], required: false },
        { model: Group, as: 'group', required: false },
        {
          model: CallParticipant,
          as: 'participants',
          include: [{ model: User, as: 'user', attributes: ['id', 'name', 'avatar'] }]
        }
      ]
    });

    // Create call message
    const callMessage = await this.createCallMessage(updatedCall, 'ended', req);

    // Emit to all participants
    const io = req.app.get('io');
    const participantIds = updatedCall.participants.map(p => p.user_id);
    
    participantIds.forEach(participantId => {
      io.to(`user_${participantId}`).emit('callEnded', {
        call: updatedCall,
        endedBy: userId,
        duration,
        message: callMessage
      });
    });

    res.json({ success: true, call: updatedCall, duration });
  } catch (error) {
    console.error('Error ending call:', error);
    res.status(500).json({ error: 'Failed to end call' });
  }
};

exports.createCallMessage = async (call, action, req) => {
  try {
    let content = '';
    const callDuration = call.duration ? this.formatDuration(call.duration) : '';
    switch (action) {
      case 'initiated':
        content = call.call_mode === 'direct' 
          ? `${call?.initiator?.name} started a call`
          : `${call?.initiator?.name} started a group call`;
        break;
      case 'accepted':
        content = `Call answered`;
        break;
      case 'declined':
        content = `❌ Declined Call`;
        break;
      case 'ended':
        content = callDuration 
          ? `📞 Call ended • Duration: ${callDuration}`
          : `📞 Call ended`;
        break;
      case 'missed':
        content = `📞 Missed call`;
        break;
    }

    const messageData = {
      sender_id: call.initiator_id,
      recipient_id: call.receiver_id,
      group_id: call.group_id,
      content,
      message_type: 'call',
      metadata: {
        call_id: call.id,
        call_type: call.call_type,
        call_mode: call.call_mode,
        action,
        duration: call.duration
      }
    };

    const message = await Message.create(messageData);

    // Create message statuses
    const recipients = [];
    if (call.call_mode === 'direct') {
      recipients.push(call.receiver_id);
    } else if (call.group_id) {
      const members = await GroupMember.findAll({
        where: {
          group_id: call.group_id,
          user_id: { [Op.ne]: call.initiator_id }
        },
        attributes: ['user_id'],
        raw: true
      });
      members.forEach(m => recipients.push(m.user_id));
    }

    if (recipients.length > 0) {
      const statusData = recipients.map(uid => ({
        message_id: message.id,
        user_id: uid,
        status: 'sent'
      }));
      await MessageStatus.bulkCreate(statusData);
    }

    const io = req.app.get('io');

    setTimeout(() => {
      if (call.receiver_id) {
        io.to(`user_${call.initiator_id}`).emit('newDirectMessage', message);
        io.to(`user_${call.receiver_id}`).emit('newDirectMessage', message);
        io.to(`user_${call.initiator_id}`).emit('messageStatusUpdated', {
          messageId: message.id,
          status: 'sent',
        });
      } else if (call.group_id) {
        io.to(`group_${call.group_id}`).emit('newGroupMessage', message);
      }
    }, 500);
    
    return await Message.findByPk(message.id, {
      include: [
        { model: User, as: 'sender', attributes: ['id', 'name', 'avatar'] },
        { model: User, as: 'recipient', attributes: ['id', 'name', 'avatar'], required: false }
      ]
    });
  } catch (error) {
    console.error('Error creating call message:', error);
    return null;
  }
};

exports.formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
};

exports.getCallHistory = async (req, res) => {
  try {
    const currentUserId = req.session.userId;
    const { page = 1, limit = 20 } = req.query;

    const { calls, pagination } = await fetchRecentCalls(currentUserId, {
      paginate: true,
      page,
      limit
    });

    res.json({
      success: true,
      data: calls,
      pagination
    });

  } catch (error) {
    console.error('Error fetching call history:', error);
    res.status(500).json({ success: false, message: 'Failed to load call history' });
  }
};