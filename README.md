<p align="center">
  <img src="material/AppIcon/V3px800.png" alt="DateMatch Logo" width="125" height="125">
  <div align="center">
    
   # DateMatch / 蛋散預約器

   ### dansan-time-reserver
    
   A tool for who often not matching hang out time with Friends.
   
   ### v0.172-alpha
  </div>
  
</p>

--- 

Link to Web App:

https://arthur042l.github.io/dansan-time-reserver/


## Todo Task:

Priority!
None

Major Changes:
- en/chin/genZ/Canton ver language
- code with 4digit #0000
  - use that code in link box
  - easy sharing (link / QRcode)
  - login page just need name, no need code when link have code
- Every event have unique sub-pages from the login html (eg. eggspread-time-reserver/#0000) but with same layout
- Brand redesign (icon, color scheme, name, website domain name)
- Tidy script.js Code.


Minor:
- modify: more unify indicator and design of date boxes
- modify: longer height date boxes for mobile mode
- All free depend on joined in and expect no. of member
- random color for profile picture(easier identification
- Event code length / character limit (10, _ / - / . / a-z / 0-9)
  - text count on create
- Settings page of the event:
  - V No. of member of expected respond
  - V Code settings
  - V Event name
  - copy link
  - Event mode (缺一不可/人多好辦事, whether everyone has to come, blocking any unfree dates, or the most free dates wins)
    - Edit most member dashboard depend on mode
  - Event duration/range (select only for a range of date to select, prevent going away.)
  - Pre-select disable dates.
  - ? admin dashboard
    - delete event
- Custom layout for weekends/ pattern dates.


## Done Task
- V ! Hide the api key in private. (updated firebase rules instead)
- V Login Page( secret code pairing for each event )
  - V only login foe existing, need register.
- V remember me ! ( name fill in )
- V date picker for free days
- V save respond button
- V Data management.
- V Today tag
- V show who free data on each day boxes
  - V when not enough space, show +[count] counter of extra member except members shown on calendar, show +2 or higher, only +1 if no space
  - V (with simple indicator, circle user icon with first letter, at most one line) (mobile)
  - V (show full name, rounded rectangle, at most two line)(click to show detail view of the day) (desktop)
- V detail view for each day on the matches chart for free members. 
  - V (only desktop) show the detail view on click on the users icon/indicator.
- V sepcial presentation for all people free
- V compact mode for phone
- V wide mode for computer tablet
- V list view showing list of all member filled the form (showing their free time)
- V ios web app bookmark icon.
- V app info
  - V author
  - V version
  - V images
- V setting of the whole website:
  - V login with Google to open admin platform for background settings...
  - V Clear storage of Remember Me
