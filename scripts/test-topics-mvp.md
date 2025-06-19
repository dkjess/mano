# MVP Topics Implementation Test Guide

## 🎯 What to Test

### **Database & API Layer**
- ✅ Topics table created with proper schema
- ✅ Messages table updated with topic_id support
- ✅ API routes implemented for CRUD operations
- ✅ Authentication and authorization working

### **Frontend Components**
- ✅ Topics section added to sidebar
- ✅ Topic creation page (`/topics/new`)
- ✅ Topic conversation page (`/topics/[id]`)
- ✅ Integration with existing chat components

### **User Experience Flow**

## 🧪 Testing Steps

### 1. **Access the Application**
- Navigate to `http://localhost:3001`
- [Login with test credentials][[memory:2929215883199205937]]: `test@mano.dev` / `testuser123`

### 2. **Test Topic Creation**
- Look for **"Topics"** section in sidebar with **"+"** button
- Click **"Create your first topic"** or **"+"** button
- Should navigate to `/topics/new`
- Fill in topic title (e.g., "Q4 Planning Meeting")
- Select participants from your team members
- Click **"Create Topic"**
- Should redirect to the new topic conversation

### 3. **Test Topic Conversation**
- Verify topic appears in sidebar under "Topics" section
- Check topic header shows title and participant count
- Send a message in the topic conversation
- Verify messages are saved and displayed correctly
- Test file attachments and streaming responses

### 4. **Test Navigation**
- Click between different topics in sidebar
- Verify active topic is highlighted
- Test navigation between topics and people conversations
- Verify URLs update correctly (`/topics/[id]`)

### 5. **Test Responsive Design**
- Test on mobile/tablet viewports
- Verify sidebar collapses properly
- Check mobile menu functionality

## ✅ Success Criteria

### **Core Functionality**
- [ ] Can create topics with title and participants
- [ ] Topics appear in sidebar navigation
- [ ] Can navigate to topic conversations
- [ ] Can send messages in topics
- [ ] Messages are persisted in database
- [ ] Participants are displayed correctly

### **Integration**
- [ ] Topics work alongside existing people conversations
- [ ] File attachments work in topic conversations  
- [ ] Streaming responses work in topics
- [ ] Mobile responsiveness maintained
- [ ] Authentication requirements enforced

### **UI/UX**
- [ ] Topics section matches existing design language
- [ ] Topic creation form is intuitive
- [ ] Navigation between topics is smooth
- [ ] Loading states are appropriate
- [ ] Error handling is graceful

## 🐛 Common Issues to Check

1. **Database Connection**: Ensure Supabase is connected
2. **Migration Status**: Verify all migrations applied successfully
3. **API Endpoints**: Check network tab for API call success
4. **Authentication**: Ensure user is logged in for all operations
5. **TypeScript Errors**: Check browser console for type issues

## 🎉 MVP Complete When...

- Users can manually create topics ✅
- Topics appear in sidebar navigation ✅  
- Topic conversations function like people conversations ✅
- Participants can be selected during creation ✅
- Topics are single-user owned ✅
- Database properly stores topic data ✅

---

**Next Steps**: After MVP validation, consider adding features like:
- Topic editing and archiving
- Smart topic suggestions
- Enhanced participant management
- Topic history compilation 